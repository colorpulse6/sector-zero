import React, { useEffect, useMemo, useRef } from "react";
import type { SaveData } from "../../engine/types";
import { checkRegionAction, OUTPOST_FOUNDING_COST } from "../region/siteEconomy";

export interface RegionMapScreenProps {
  save: SaveData;
  originColonyId: string;
  mode: "pad" | "view";
  onClose: () => void;
  onSurvey?: (nodeId: string) => void;
  onTravel?: (nodeId: string) => void;
  onFound?: (nodeId: string) => void;
}

export function RegionMapScreen({ save, originColonyId, mode, onClose, onSurvey, onTravel, onFound }: RegionMapScreenProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const colony = save.colonies.find(entry => entry.id === originColonyId) ?? save.colonies[0];
  const planet = save.planets.find(entry => entry.id === colony?.planetId);
  const nodes = planet?.regionMap.nodes ?? [];
  const visibleNodes = nodes.filter(node => node.intel !== "unknown" || planet?.regionMap.edges.some(([a, b]) => (a === node.id || b === node.id) && nodes.find(n => n.id === (a === node.id ? b : a))?.intel !== "unknown"));
  const visibleIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusable = () => [...root.querySelectorAll<HTMLElement>("button:not([disabled])")];
    focusable()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!planet || !colony) return null;
  const cyan = "#00f0ff";
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Region map" style={{ position: "fixed", inset: 0, zIndex: 1200, overflow: "auto", background: "#070b12", color: "#e0e6ed", fontFamily: "ui-monospace, Menlo, monospace", padding: 20 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cyan}`, paddingBottom: 12 }}>
      <button onClick={onClose}>← BACK</button>
      <div><h1 style={{ margin: 0, color: cyan }}>ASHFALL REGION</h1><small>{mode === "pad" ? `PAD LINK — ${colony.name}` : "COCKPIT VIEW — ACTIONS LOCKED"}</small></div>
    </header>
    <div style={{ position: "relative", maxWidth: 900, margin: "20px auto" }}>
      <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {planet.regionMap.edges.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b)).map(([a, b]) => {
          const from = nodes.find(n => n.id === a)!, to = nodes.find(n => n.id === b)!;
          return <line key={`${a}:${b}`} x1={from.coords.x} y1={from.coords.y} x2={to.coords.x} y2={to.coords.y} stroke="#295066" strokeWidth="0.5" />;
        })}
      </svg>
      <div style={{ display: "grid", gap: 12, position: "relative" }}>
        {visibleNodes.map(node => {
          const label = node.intel === "unknown" ? "UNKNOWN SIGNAL" : node.name;
          const survey = mode === "pad" && checkRegionAction(save, colony.id, node.id, "survey").allowed;
          const travel = mode === "pad" && checkRegionAction(save, colony.id, node.id, "travel").allowed;
          const found = mode === "pad" && checkRegionAction(save, colony.id, node.id, "found").allowed;
          const connections = planet.regionMap.edges.filter(([a, b]) => a === node.id || b === node.id).map(([a, b]) => nodes.find(n => n.id === (a === node.id ? b : a))).filter(Boolean).map(n => n!.intel === "unknown" ? "UNKNOWN SIGNAL" : n!.name).join(", ");
          return <article key={node.id} aria-label={`${label}, ${node.intel}`} style={{ border: "1px solid #234052", background: "rgba(8,20,30,.9)", padding: 14 }}>
            <strong style={{ color: cyan }}>{label}</strong> <span>{node.intel.toUpperCase()}</span>
            <p>Connections: {connections || "None"}</p>
            {node.siteStats && node.intel !== "unknown" && node.intel !== "rumored" && <dl style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div><dt>ORE DENSITY</dt><dd>{node.siteStats.oreDensity}</dd></div><div><dt>WATER TABLE</dt><dd>{node.siteStats.waterTable}</dd></div><div><dt>BUILDABLE SLOTS</dt><dd>{node.siteStats.buildableSlots}</dd></div><div><dt>THREAT</dt><dd>{node.siteStats.threat}</dd></div>
            </dl>}
            {survey && <button onClick={() => onSurvey?.(node.id)} aria-label={`Survey ${label}`}>SURVEY · 1 CYCLE</button>}
            {travel && <button onClick={() => onTravel?.(node.id)} aria-label={`Travel to ${label}`}>TRAVEL · 1 CYCLE</button>}
            {found && <button onClick={() => onFound?.(node.id)} aria-label={`Found outpost at ${label}`}>FOUND OUTPOST · {OUTPOST_FOUNDING_COST.metal} METAL · {OUTPOST_FOUNDING_COST.food} FOOD · {OUTPOST_FOUNDING_COST.water} WATER</button>}
          </article>;
        })}
      </div>
    </div>
  </div>;
}

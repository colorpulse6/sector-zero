import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SaveData } from "../../engine/types";
import { useModalFocus } from "../../ui/ModalFocus";
import type { RegionIntelState, RegionNode } from "../shared/colonyTypes";
import { poiEncounterLabel } from "../region/poiCatalog";
import { REGION_INTEL_ORDER } from "../region/regionMap";
import {
  checkRegionAction,
  OUTPOST_FOUNDING_COST,
  type RegionAction,
  type RegionActionBlockReason,
} from "../region/siteEconomy";
import {
  initialRegionSelection,
  moveRegionSelection,
  moveRegionSelectionSpatial,
  reconcileRegionSelection,
  type RegionSelectionDirection,
  type RegionSpatialDirection,
} from "./regionMapSelection";
import { BIOME_PALETTES, generateRegionTerrain } from "./regionMapTerrain";

export interface RegionMapScreenProps {
  save: SaveData;
  originColonyId: string;
  source: "atlas" | "landing-pad" | "cockpit";
  actionsEnabled: boolean;
  focusActive?: boolean;
  onClose: () => void;
  onSurvey?: (nodeId: string) => void;
  onTravel?: (nodeId: string) => void;
  onFound?: (nodeId: string) => void;
  initialSelectedNodeId?: string;
}

type SelectedAction = {
  kind: RegionAction;
  label: string;
  onActivate: (() => void) | undefined;
};

type MarkerKind = "colony" | "ruins" | "wreck" | "cave" | "bunker" | "settlement" | "anomaly" | "unknown";

const CYAN = "#00f0ff";

const INTEL_COLORS: Record<RegionIntelState, string> = {
  unknown: "#6b7f8a",
  rumored: "#ffb347",
  surveyed: CYAN,
  cleared: "#44ff99",
  claimed: "#ffffff",
};

const LEGEND_MARKERS: ReadonlyArray<{ kind: MarkerKind; label: string }> = [
  { kind: "colony", label: "Colony site" },
  { kind: "ruins", label: "Ruins" },
  { kind: "wreck", label: "Wreck" },
  { kind: "cave", label: "Cave" },
  { kind: "unknown", label: "Unknown signal" },
];

const LEGEND_INTEL: ReadonlyArray<RegionIntelState> = ["rumored", "surveyed", "cleared", "claimed"];

function visibleRegionNodes(nodes: readonly RegionNode[], edges: readonly [string, string][]): RegionNode[] {
  return nodes.filter(node => node.intel !== "unknown" || edges.some(([a, b]) => {
    if (a !== node.id && b !== node.id) return false;
    const neighborId = a === node.id ? b : a;
    return nodes.find(neighbor => neighbor.id === neighborId)?.intel !== "unknown";
  }));
}

function nodeLabel(node: RegionNode): string {
  return node.intel === "unknown" ? "UNKNOWN SIGNAL" : node.name;
}

/** Unknown nodes always draw the generic marker so their true type never leaks through the chart. */
function markerKindFor(node: RegionNode): MarkerKind {
  if (node.intel === "unknown") return "unknown";
  switch (node.type) {
    case "colony_site":
    case "abandoned_colony":
      return "colony";
    case "ruins":
      return "ruins";
    case "wreck":
    case "crash_site":
      return "wreck";
    case "cave":
      return "cave";
    case "hollow_bunker":
    case "raider_outpost":
      return "bunker";
    case "neutral_village":
      return "settlement";
    case "anomaly":
    case "wilderness":
      return "anomaly";
  }
}

function selectedAction(
  save: SaveData,
  originColonyId: string,
  node: RegionNode,
  actionsEnabled: boolean,
  callbacks: Pick<RegionMapScreenProps, "onSurvey" | "onTravel" | "onFound">,
): SelectedAction | null {
  if (!actionsEnabled || node.intel === "unknown") return null;
  const label = nodeLabel(node);
  if (checkRegionAction(save, originColonyId, node.id, "survey").allowed) {
    return { kind: "survey", label: `Survey ${label}`, onActivate: callbacks.onSurvey ? () => callbacks.onSurvey?.(node.id) : undefined };
  }
  if (checkRegionAction(save, originColonyId, node.id, "travel").allowed) {
    return { kind: "travel", label: `Travel to ${label}`, onActivate: callbacks.onTravel ? () => callbacks.onTravel?.(node.id) : undefined };
  }
  if (checkRegionAction(save, originColonyId, node.id, "found").allowed) {
    return { kind: "found", label: `Found outpost at ${label}`, onActivate: callbacks.onFound ? () => callbacks.onFound?.(node.id) : undefined };
  }
  return null;
}

function unavailableCopy(
  save: SaveData,
  originColonyId: string,
  originNodeId: string,
  node: RegionNode,
  source: RegionMapScreenProps["source"],
  actionsEnabled: boolean,
): string {
  if (!actionsEnabled) return source === "cockpit"
    ? "COCKPIT VIEW — REGION ACTIONS ARE UNAVAILABLE. DESCEND TO A COLONY LANDING PAD TO CONTINUE."
    : "REGION ACTIONS ARE UNAVAILABLE FROM THIS LINK.";
  if (node.intel === "unknown") return "INTEL INSUFFICIENT — DESTINATION DETAILS AND ACTIONS ARE UNAVAILABLE.";
  if (node.id === originNodeId) return "ORIGIN NODE — NO ACTION AVAILABLE.";
  const checks = (["survey", "travel", "found"] as const).map(action => checkRegionAction(save, originColonyId, node.id, action));
  const reasons = checks.filter(check => !check.allowed).map(check => check.reason);
  if (reasons.includes("target_not_adjacent")) return "UNAVAILABLE — DESTINATION IS NOT ADJACENT TO THIS ORIGIN.";
  if (reasons.includes("insufficient_resources")) return "FOUNDING UNAVAILABLE — ORIGIN STOCKPILE DOES NOT MEET THE RESOURCE COST.";
  if (reasons.includes("site_already_claimed")) return "CLAIMED COLONY — NO ACTION AVAILABLE FROM THIS ORIGIN.";
  if (reasons.includes("origin_not_claimed") || reasons.includes("origin_node_missing")) return "UNAVAILABLE — SELECTED ORIGIN CANNOT LAUNCH REGION ACTIONS.";
  return "NO ELIGIBLE ACTION — SURVEY OR APPROACH THIS DESTINATION FROM AN ADJACENT CLAIMED COLONY.";
}

function primaryBlockReason(
  save: SaveData,
  originColonyId: string,
  node: RegionNode,
): RegionActionBlockReason | null {
  for (const action of ["survey", "travel", "found"] as const) {
    const check = checkRegionAction(save, originColonyId, node.id, action);
    if (!check.allowed) return check.reason;
  }
  return null;
}

/** Small marker glyph shared by the chart and the legend. */
function Marker({ kind, color, size = 26, filled = false }: { kind: MarkerKind; color: string; size?: number; filled?: boolean }) {
  const fill = filled ? color : "rgba(5, 12, 20, .92)";
  const common = { stroke: color, strokeWidth: 1.8, fill, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      {kind === "colony" && <polygon points="12,2.5 20.5,7.25 20.5,16.75 12,21.5 3.5,16.75 3.5,7.25" {...common} />}
      {kind === "colony" && <circle cx="12" cy="12" r="2.4" fill={filled ? "#071018" : color} />}
      {kind === "ruins" && <polygon points="12,3 21,20 3,20" {...common} />}
      {kind === "ruins" && <line x1="12" y1="10" x2="12" y2="16" stroke={filled ? "#071018" : color} strokeWidth="1.6" />}
      {kind === "wreck" && <polygon points="12,2.5 21.5,12 12,21.5 2.5,12" {...common} />}
      {kind === "wreck" && <line x1="8" y1="8" x2="16" y2="16" stroke={filled ? "#071018" : color} strokeWidth="1.4" />}
      {kind === "wreck" && <line x1="16" y1="8" x2="8" y2="16" stroke={filled ? "#071018" : color} strokeWidth="1.4" />}
      {kind === "cave" && <circle cx="12" cy="12" r="9" {...common} />}
      {kind === "cave" && <path d="M7 14 Q12 6 17 14 Z" fill={filled ? "#071018" : color} />}
      {kind === "bunker" && <rect x="4" y="4" width="16" height="16" {...common} />}
      {kind === "bunker" && <rect x="9" y="9" width="6" height="6" fill={filled ? "#071018" : color} />}
      {kind === "settlement" && <circle cx="12" cy="12" r="9" {...common} />}
      {kind === "settlement" && <circle cx="12" cy="12" r="3" fill={filled ? "#071018" : color} />}
      {kind === "anomaly" && <polygon points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5" {...common} />}
      {kind === "unknown" && <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" strokeDasharray="3 2.4" fill="rgba(5, 12, 20, .7)" vectorEffect="non-scaling-stroke" />}
      {kind === "unknown" && <text x="12" y="16" textAnchor="middle" fontSize="11" fontFamily="ui-monospace, Menlo, monospace" fill={color}>?</text>}
    </svg>
  );
}

function StatBar({ value, max = 100, tone }: { value: number; max?: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="rm-bar" aria-hidden="true">
      <span className="rm-bar-fill" style={{ width: `${pct}%`, background: tone }} />
    </span>
  );
}

const STYLES = `
.rm-root{position:fixed;inset:0;z-index:1200;overflow:auto;background:#070b12;color:#e0e6ed;font-family:ui-monospace,Menlo,Consolas,monospace;outline:none}
.rm-shell{min-height:100%;display:flex;flex-direction:column}
.rm-header{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(0,240,255,.35);background:linear-gradient(180deg,rgba(0,240,255,.06),transparent)}
.rm-back{min-height:38px;padding:8px 14px;border:1px solid rgba(0,240,255,.45);background:rgba(0,240,255,.06);color:#e7fcff;font:inherit;font-size:12px;letter-spacing:.08em;cursor:pointer}
.rm-back:hover,.rm-back:focus-visible{background:rgba(0,240,255,.16);outline:none;border-color:${CYAN}}
.rm-title{text-align:center;min-width:0}
.rm-title h1{margin:0;font-size:20px;letter-spacing:.32em;color:${CYAN};text-shadow:0 0 18px rgba(0,240,255,.35);font-weight:600}
.rm-title small{display:block;margin-top:4px;font-size:11px;letter-spacing:.18em;color:#8fb3c4}
.rm-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.rm-chip{font-size:11px;letter-spacing:.12em;padding:6px 10px;border:1px solid rgba(0,240,255,.25);background:rgba(0,240,255,.04);color:#bfe9f2;white-space:nowrap}
.rm-chip b{color:#fff;font-weight:600}
.rm-body{flex:1;display:grid;grid-template-columns:minmax(0,1fr);gap:18px;padding:18px 20px 24px;max-width:1360px;width:100%;margin:0 auto;box-sizing:border-box}
@media (min-width:960px){.rm-body{grid-template-columns:minmax(0,1fr) 352px;align-items:start}}
.rm-map-col{min-width:0;display:flex;flex-direction:column;gap:12px}
.rm-map{position:relative;width:100%;max-width:min(100%,calc((100vh - 230px) * 1.22));margin:0 auto;aspect-ratio:1.22;border:1px solid rgba(0,240,255,.35);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 42px rgba(0,240,255,.08) inset;overflow:hidden;background:#0b0a08;user-select:none}
.rm-map::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)}
.rm-layer{position:absolute;inset:0}
.rm-grid{background-size:10% 10%,10% 10%,2% 2%,2% 2%}
.rm-corner{position:absolute;width:14px;height:14px;border-color:${CYAN};border-style:solid;opacity:.9}
.rm-corner.tl{top:6px;left:6px;border-width:1px 0 0 1px}.rm-corner.tr{top:6px;right:6px;border-width:1px 1px 0 0}.rm-corner.bl{bottom:6px;left:6px;border-width:0 0 1px 1px}.rm-corner.br{bottom:6px;right:6px;border-width:0 1px 1px 0}
.rm-map-tag{position:absolute;font-size:10px;letter-spacing:.16em;color:rgba(191,233,242,.75);pointer-events:none}
.rm-map-tag.tl{top:10px;left:26px}.rm-map-tag.br{bottom:10px;right:26px;text-align:right}
.rm-compass{position:absolute;top:12px;right:28px;width:34px;height:34px;pointer-events:none;opacity:.8}
.rm-scale{position:absolute;bottom:14px;left:28px;display:flex;flex-direction:column;gap:3px;font-size:9px;letter-spacing:.14em;color:rgba(191,233,242,.7);pointer-events:none}
.rm-scale i{display:block;width:72px;height:4px;border:1px solid rgba(0,240,255,.6);border-top:none;background:linear-gradient(90deg,${CYAN} 0 50%,transparent 50%);opacity:.8}
.rm-spot{position:absolute;width:34%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(0,240,255,.22),rgba(0,240,255,.05) 45%,transparent 70%);pointer-events:none;transition:left .32s ease,top .32s ease}
.rm-haze{position:absolute;width:26%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(4,8,14,.75),rgba(4,8,14,.35) 50%,transparent 72%);pointer-events:none}
.rm-edge-tag{position:absolute;transform:translate(-50%,-50%);font-size:9px;letter-spacing:.14em;padding:2px 6px;background:rgba(5,12,20,.9);border:1px solid rgba(0,240,255,.35);color:#9fd9e6;pointer-events:none;white-space:nowrap}
.rm-opt{position:absolute;width:36px;height:36px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;border-radius:50%;z-index:2}
.rm-opt-ring{position:absolute;inset:-5px;border-radius:50%;border:1px solid transparent;transition:border-color .2s,box-shadow .2s}
.rm-opt[aria-selected="true"]{z-index:3}
.rm-opt[aria-selected="true"] .rm-opt-ring{border-color:${CYAN};box-shadow:0 0 0 3px rgba(0,240,255,.16),0 0 24px rgba(0,240,255,.45)}
.rm-opt:focus-visible .rm-opt-ring{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.22),0 0 24px rgba(0,240,255,.45)}
.rm-opt:hover .rm-opt-ring{border-color:rgba(0,240,255,.7)}
.rm-opt-bracket{position:absolute;inset:-11px;pointer-events:none;opacity:0;transition:opacity .2s}
.rm-opt[aria-selected="true"] .rm-opt-bracket{opacity:1}
.rm-opt-bracket::before,.rm-opt-bracket::after{content:"";position:absolute;width:10px;height:10px;border:1px solid ${CYAN}}
.rm-opt-bracket::before{top:0;left:0;border-width:1px 0 0 1px}.rm-opt-bracket::after{bottom:0;right:0;border-width:0 1px 1px 0}
.rm-opt-origin{position:absolute;inset:-9px;border-radius:50%;border:1px dashed rgba(255,255,255,.5);pointer-events:none}
.rm-label{position:absolute;display:flex;flex-direction:column;gap:2px;white-space:nowrap;pointer-events:none;text-shadow:0 1px 2px #000,0 0 8px rgba(0,0,0,.9)}
.rm-label[data-place="below"]{top:calc(100% + 6px);left:50%;transform:translateX(-50%);align-items:center;text-align:center}
.rm-label[data-place="above"]{bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);align-items:center;text-align:center}
.rm-label[data-place="right"]{left:calc(100% + 10px);top:50%;transform:translateY(-50%);align-items:flex-start}
.rm-label[data-place="left"]{right:calc(100% + 10px);top:50%;transform:translateY(-50%);align-items:flex-end;text-align:right}
.rm-label strong{font-size:12px;letter-spacing:.06em;font-weight:600;color:#e7fcff}
.rm-opt[aria-selected="true"] .rm-label strong{color:#fff}
.rm-label span{font-size:9px;letter-spacing:.16em;padding:1px 5px;border:1px solid currentColor;opacity:.95;background:rgba(5,12,20,.85)}
.rm-legend{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:10px;letter-spacing:.14em;color:#9fb9c6;padding:0 4px}
.rm-legend-item{display:inline-flex;align-items:center;gap:6px;text-transform:uppercase}
.rm-legend-swatch{width:9px;height:9px;border-radius:50%;display:inline-block;box-shadow:0 0 8px currentColor}
.rm-legend-sep{width:1px;height:14px;background:rgba(0,240,255,.25)}
.rm-keys{font-size:10px;letter-spacing:.12em;color:#6f8b99;padding:0 4px}
.rm-keys kbd{font:inherit;padding:1px 5px;border:1px solid rgba(0,240,255,.3);color:#bfe9f2;background:rgba(0,240,255,.05)}
.rm-panel{position:sticky;top:12px;border:1px solid ${CYAN};background:linear-gradient(180deg,rgba(6,18,28,.98),rgba(4,12,20,.98));padding:18px;min-height:260px;box-shadow:0 0 30px rgba(0,240,255,.08)}
.rm-panel small.rm-eyebrow{display:block;font-size:10px;letter-spacing:.2em;color:#8aa7b8}
.rm-panel h2{color:${CYAN};margin:6px 0 10px;font-size:20px;letter-spacing:.08em;text-shadow:0 0 14px rgba(0,240,255,.3)}
.rm-ladder{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:0 0 14px}
.rm-ladder i{display:block;height:5px;background:rgba(0,240,255,.1);border:1px solid rgba(0,240,255,.18)}
.rm-ladder i.on{background:var(--rm-intel);border-color:var(--rm-intel);box-shadow:0 0 8px var(--rm-intel)}
.rm-dl{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;margin:0;font-size:12px}
.rm-dl dt{color:#8aa7b8;letter-spacing:.12em}
.rm-dl dd{margin:0;color:#e7fcff;letter-spacing:.06em}
.rm-stats{margin-top:16px;padding-top:14px;border-top:1px solid #234052}
.rm-stats .rm-dl dd{display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:center}
.rm-bar{display:block;height:6px;background:rgba(255,255,255,.06);border:1px solid rgba(0,240,255,.18);overflow:hidden}
.rm-bar-fill{display:block;height:100%}
.rm-slots{display:inline-flex;gap:3px}
.rm-slots i{width:8px;height:8px;border:1px solid ${CYAN};background:rgba(0,240,255,.55)}
.rm-action-wrap{border-top:1px solid #234052;margin-top:18px;padding-top:18px}
.rm-action{width:100%;padding:14px 16px;border:2px solid ${CYAN};background:rgba(0,240,255,.12);color:#fff;font:inherit;letter-spacing:.1em;cursor:pointer;transition:background .15s,box-shadow .15s}
.rm-action:hover,.rm-action:focus-visible{background:rgba(0,240,255,.24);box-shadow:0 0 22px rgba(0,240,255,.35);outline:none}
.rm-blocked{margin:0;color:#a9bdc8;font-size:12px;line-height:1.55;letter-spacing:.04em}
@media (prefers-reduced-motion:no-preference){
  .rm-opt[aria-selected="true"] .rm-opt-ring{animation:rm-pulse 1.8s ease-in-out infinite}
  .rm-opt[data-unknown="true"] svg{animation:rm-flicker 2.6s steps(2,end) infinite}
  @keyframes rm-pulse{0%,100%{box-shadow:0 0 0 3px rgba(0,240,255,.16),0 0 24px rgba(0,240,255,.45)}50%{box-shadow:0 0 0 6px rgba(0,240,255,.08),0 0 34px rgba(0,240,255,.6)}}
  @keyframes rm-flicker{0%,100%{opacity:1}50%{opacity:.55}}
}
`;

export function RegionMapScreen({
  save,
  originColonyId,
  source,
  actionsEnabled,
  focusActive = true,
  onClose,
  onSurvey,
  onTravel,
  onFound,
  initialSelectedNodeId,
}: RegionMapScreenProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const actionRef = useRef<HTMLButtonElement>(null);

  const colony = save.colonies.find(entry => entry.id === originColonyId) ?? save.colonies[0];
  const planet = save.planets.find(entry => entry.id === colony?.planetId);
  const nodes = planet?.regionMap.nodes ?? [];
  const edges = planet?.regionMap.edges ?? [];
  const visibleNodes = useMemo(() => visibleRegionNodes(nodes, edges), [nodes, edges]);
  const visibleNodeIds = visibleNodes.map(node => node.id);
  const visibleNodeKey = visibleNodeIds.join("\u0000");
  const originNodeId = colony?.regionNodeId ?? "";
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    if (initialSelectedNodeId && visibleNodeIds.includes(initialSelectedNodeId)) return initialSelectedNodeId;
    return initialRegionSelection(visibleNodeIds, originNodeId);
  });

  useEffect(() => {
    setSelectedNodeId(current => reconcileRegionSelection(current, visibleNodeIds, originNodeId));
  }, [visibleNodeKey, originNodeId]);

  useModalFocus({ active: focusActive, rootRef: dialogRef,
    initialFocus: () => optionRefs.current.get(selectedNodeId ?? "") ?? null, onEscape: onClose });

  const biome = planet?.biome ?? "barren";
  const palette = BIOME_PALETTES[biome];
  const terrain = useMemo(() => generateRegionTerrain(planet?.regionMap.seed ?? 0, biome), [planet?.regionMap.seed, biome]);

  if (!planet || !colony) return null;
  const selectedNode = visibleNodes.find(node => node.id === selectedNodeId) ?? visibleNodes[0] ?? null;
  const action = selectedNode
    ? selectedAction(save, colony.id, selectedNode, actionsEnabled, { onSurvey, onTravel, onFound })
    : null;
  const visibleIds = new Set(visibleNodeIds);
  const nodeById = new Map(nodes.map(node => [node.id, node] as const));
  const visibleEdges = edges.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b));
  const adjacentToOrigin = new Set(visibleEdges.flatMap(([a, b]) => (a === originNodeId ? [b] : b === originNodeId ? [a] : [])));
  const points = visibleNodes.map(node => ({ id: node.id, x: node.coords.x, y: node.coords.y }));
  const tally = REGION_INTEL_ORDER
    .map(intel => ({ intel, count: visibleNodes.filter(node => node.intel === intel).length }))
    .filter(entry => entry.count > 0);
  const originColonyAtSelected = selectedNode ? save.colonies.find(entry => entry.regionNodeId === selectedNode.id) ?? null : null;

  const focusOption = (id: string | null) => {
    if (!id) return;
    setSelectedNodeId(id);
    const option = optionRefs.current.get(id);
    option?.focus();
    option?.scrollIntoView({ block: "nearest" });
  };

  const moveOrdered = (direction: RegionSelectionDirection) => {
    focusOption(moveRegionSelection(selectedNodeId, visibleNodeIds, direction));
  };

  const moveSpatial = (direction: RegionSpatialDirection, fallback?: RegionSelectionDirection) => {
    const next = moveRegionSelectionSpatial(selectedNodeId, points, direction);
    if (next) focusOption(next);
    else if (fallback) moveOrdered(fallback);
  };

  const focusAction = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    event.stopPropagation();
    actionRef.current?.focus();
  };

  const labelPlace = (node: RegionNode): "below" | "above" | "left" | "right" => {
    if (node.coords.x > 78) return "left";
    if (node.coords.x < 22) return "right";
    if (node.coords.y > 76) return "above";
    return "below";
  };

  const backLabel = source === "atlas" ? "RETURN TO ATLAS" : source === "landing-pad" ? "RETURN TO LANDING PAD" : "RETURN TO COLONIES";
  const provenance = source === "atlas" ? `ATLAS LINK — ${colony.name}` : source === "landing-pad" ? `PAD LINK — ${colony.name}` : "COCKPIT VIEW";
  const intelIndex = selectedNode ? REGION_INTEL_ORDER.indexOf(selectedNode.intel) : -1;
  const selectedTone = selectedNode ? INTEL_COLORS[selectedNode.intel] : CYAN;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Region map"
      className="rm-root"
    >
      <style>{STYLES}</style>
      <div className="rm-shell">
        <header className="rm-header">
          <button className="rm-back" onClick={onClose}>← {backLabel}</button>
          <div className="rm-title">
            <h1>{planet.id.toUpperCase()} REGION</h1>
            <small>{provenance}{!actionsEnabled ? " — ACTIONS LOCKED" : ""}</small>
          </div>
          <div className="rm-chips" aria-label="Region status">
            <span className="rm-chip">ORIGIN <b>{colony.name.toUpperCase()}</b></span>
            <span className="rm-chip">CYCLE <b>{save.missionsSinceStart}</b></span>
            <span className="rm-chip">{tally.map(entry => `${entry.count} ${entry.intel.toUpperCase()}`).join(" · ")}</span>
          </div>
        </header>

        <div className="rm-body">
          <div className="rm-map-col">
            <div
              className="rm-map"
              role="listbox"
              aria-label="Region destinations"
              data-region-node-list="true"
              style={{ background: `radial-gradient(ellipse at 50% 40%, ${palette.base}, ${palette.deep} 85%)` }}
            >
              {/* Terrain: decorative, cropped to the frame. */}
              <svg aria-hidden="true" className="rm-layer" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <radialGradient id="rm-haze-grad" cx="50%" cy="45%" r="60%">
                    <stop offset="0%" stopColor={palette.haze} />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="url(#rm-haze-grad)" />
                {terrain.contours.map((ring, index) => (
                  <polygon key={`c${index}`} points={ring.points} fill="none" stroke={palette.contour} strokeOpacity={ring.alpha} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
                ))}
                {terrain.ridges.map((ridge, index) => (
                  <polyline key={`r${index}`} points={ridge.points} fill="none" stroke={palette.ridge} strokeOpacity={ridge.alpha} strokeWidth="1.1" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                ))}
                {terrain.specks.map((speck, index) => (
                  <circle key={`s${index}`} cx={speck.x} cy={speck.y} r={speck.r} fill={palette.ridge} fillOpacity={speck.alpha} />
                ))}
              </svg>
              <div
                aria-hidden="true"
                className="rm-layer rm-grid"
                style={{ backgroundImage: `linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)` }}
              />

              {/* Unknown signals sit under a haze so the chart reads as fogged there. */}
              {visibleNodes.filter(node => node.intel === "unknown").map(node => (
                <div key={`h${node.id}`} aria-hidden="true" className="rm-haze" style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }} />
              ))}

              {/* Routes between charted nodes, stretched to the chart frame so endpoints meet the markers. */}
              <svg aria-hidden="true" className="rm-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                {visibleEdges.map(([a, b]) => {
                  const from = nodeById.get(a)!;
                  const to = nodeById.get(b)!;
                  const touchesSelected = selectedNode !== null && (a === selectedNode.id || b === selectedNode.id);
                  const touchesUnknown = from.intel === "unknown" || to.intel === "unknown";
                  const fromOrigin = a === originNodeId || b === originNodeId;
                  const stroke = touchesSelected ? CYAN : fromOrigin ? "rgba(0,240,255,.75)" : "rgba(143,179,196,.55)";
                  return (
                    <g key={`${a}:${b}`}>
                      <line x1={from.coords.x} y1={from.coords.y} x2={to.coords.x} y2={to.coords.y} stroke="rgba(0,0,0,.7)" strokeWidth={touchesSelected ? 5 : 3.5} vectorEffect="non-scaling-stroke" />
                      <line
                        x1={from.coords.x} y1={from.coords.y} x2={to.coords.x} y2={to.coords.y}
                        stroke={stroke}
                        strokeWidth={touchesSelected ? 1.8 : 1.1}
                        strokeDasharray={touchesUnknown ? "2 3" : fromOrigin ? "6 3" : undefined}
                        strokeOpacity={touchesUnknown ? 0.55 : 1}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Travel cost tags on routes out of the origin. */}
              {visibleEdges
                .filter(([a, b]) => (a === originNodeId || b === originNodeId) && nodeById.get(a)!.intel !== "unknown" && nodeById.get(b)!.intel !== "unknown")
                .map(([a, b]) => {
                  const from = nodeById.get(a)!;
                  const to = nodeById.get(b)!;
                  return (
                    <span key={`t${a}:${b}`} aria-hidden="true" className="rm-edge-tag" style={{ left: `${(from.coords.x + to.coords.x) / 2}%`, top: `${(from.coords.y + to.coords.y) / 2}%` }}>
                      1 CYCLE
                    </span>
                  );
                })}

              {selectedNode && (
                <div aria-hidden="true" className="rm-spot" style={{ left: `${selectedNode.coords.x}%`, top: `${selectedNode.coords.y}%` }} />
              )}

              {visibleNodes.map(node => {
                const label = nodeLabel(node);
                const selected = node.id === selectedNode?.id;
                const tone = INTEL_COLORS[node.intel];
                const kind = markerKindFor(node);
                return (
                  <div
                    key={node.id}
                    ref={element => {
                      if (element) optionRefs.current.set(node.id, element);
                      else optionRefs.current.delete(node.id);
                    }}
                    role="option"
                    aria-selected={selected}
                    aria-label={`${label}, ${node.intel}`}
                    tabIndex={selected ? 0 : -1}
                    className="rm-opt"
                    data-unknown={node.intel === "unknown" ? "true" : undefined}
                    style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
                    onClick={event => {
                      setSelectedNodeId(node.id);
                      event.currentTarget.focus();
                    }}
                    onKeyDown={event => {
                      switch (event.key) {
                        case "ArrowDown": event.preventDefault(); moveSpatial("down", "next"); break;
                        case "ArrowUp": event.preventDefault(); moveSpatial("up", "previous"); break;
                        case "ArrowRight": event.preventDefault(); moveSpatial("right"); break;
                        case "ArrowLeft": event.preventDefault(); moveSpatial("left"); break;
                        default: focusAction(event);
                      }
                    }}
                  >
                    <span className="rm-opt-ring" aria-hidden="true" />
                    <span className="rm-opt-bracket" aria-hidden="true" />
                    {node.id === originNodeId && <span className="rm-opt-origin" aria-hidden="true" />}
                    <Marker kind={kind} color={tone} filled={node.intel === "claimed"} size={node.id === originNodeId ? 30 : 26} />
                    <span className="rm-label" data-place={labelPlace(node)} aria-hidden="true" style={{ color: tone }}>
                      <strong>{label}</strong>
                      <span>{node.id === originNodeId ? "ORIGIN" : node.intel.toUpperCase()}</span>
                    </span>
                  </div>
                );
              })}

              <span aria-hidden="true" className="rm-corner tl" /><span aria-hidden="true" className="rm-corner tr" />
              <span aria-hidden="true" className="rm-corner bl" /><span aria-hidden="true" className="rm-corner br" />
              <span aria-hidden="true" className="rm-map-tag tl">SURFACE CHART · {palette.label.toUpperCase()}</span>
              <span aria-hidden="true" className="rm-map-tag br">SEED {planet.regionMap.seed} · {visibleNodes.length} CONTACTS</span>
              <svg aria-hidden="true" className="rm-compass" viewBox="0 0 34 34">
                <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(0,240,255,.45)" strokeWidth="1" />
                <polygon points="17,4 20,17 17,15 14,17" fill={CYAN} />
                <polygon points="17,30 20,17 17,19 14,17" fill="rgba(0,240,255,.35)" />
                <text x="17" y="3" textAnchor="middle" fontSize="6" fill={CYAN} fontFamily="ui-monospace, Menlo, monospace">N</text>
              </svg>
              <span aria-hidden="true" className="rm-scale"><i /><span>1 CYCLE / ROUTE</span></span>
            </div>

            <div className="rm-legend" aria-hidden="true">
              {LEGEND_MARKERS.map(entry => (
                <span key={entry.kind} className="rm-legend-item">
                  <Marker kind={entry.kind} color={entry.kind === "unknown" ? INTEL_COLORS.unknown : "#bfe9f2"} size={14} />
                  {entry.label}
                </span>
              ))}
              <span className="rm-legend-sep" />
              {LEGEND_INTEL.map(intel => (
                <span key={intel} className="rm-legend-item" style={{ color: INTEL_COLORS[intel] }}>
                  <span className="rm-legend-swatch" style={{ background: INTEL_COLORS[intel] }} />
                  {intel.charAt(0).toUpperCase() + intel.slice(1)}
                </span>
              ))}
            </div>
            <div className="rm-keys" aria-hidden="true">
              <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> select destination · <kbd>Enter</kbd> / <kbd>Z</kbd> go to action · <kbd>Esc</kbd> back
            </div>
          </div>

          <section
            data-region-detail-panel="true"
            aria-live="polite"
            className="rm-panel"
            style={{ ["--rm-intel" as string]: selectedTone } as React.CSSProperties}
          >
            {selectedNode ? (
              <>
                <small className="rm-eyebrow">SELECTED DESTINATION</small>
                <h2>{nodeLabel(selectedNode)}</h2>
                <div className="rm-ladder" aria-hidden="true">
                  {REGION_INTEL_ORDER.map((intel, index) => (
                    <i key={intel} className={index <= intelIndex && selectedNode.intel !== "unknown" ? "on" : undefined} />
                  ))}
                </div>
                <dl className="rm-dl">
                  <dt>INTEL</dt><dd style={{ color: selectedTone }}>{selectedNode.intel.toUpperCase()}</dd>
                  <dt>ENCOUNTER</dt><dd>{selectedNode.intel === "unknown" ? "UNKNOWN" : (poiEncounterLabel(selectedNode) ?? (selectedNode.type === "colony_site" ? "COLONY SITE" : "UNAVAILABLE"))}</dd>
                  {selectedNode.id !== originNodeId && selectedNode.intel !== "unknown" && <><dt>TRAVEL COST</dt><dd>1 CYCLE</dd></>}
                  {selectedNode.id !== originNodeId && selectedNode.intel !== "unknown" && (
                    <><dt>ROUTE</dt><dd>{adjacentToOrigin.has(selectedNode.id) ? `ADJACENT TO ${colony.name.toUpperCase()}` : "NOT ADJACENT TO ORIGIN"}</dd></>
                  )}
                  {originColonyAtSelected && (
                    <><dt>COLONY</dt><dd>{originColonyAtSelected.name.toUpperCase()} · TIER {originColonyAtSelected.tier} · {originColonyAtSelected.foundingType.toUpperCase()}</dd></>
                  )}
                </dl>

                {selectedNode.siteStats && selectedNode.intel !== "unknown" && selectedNode.intel !== "rumored" && (
                  <div className="rm-stats">
                    <small className="rm-eyebrow" style={{ marginBottom: 10 }}>SITE SURVEY</small>
                    <dl className="rm-dl">
                      <dt>ORE DENSITY</dt><dd><span>{selectedNode.siteStats.oreDensity}</span><StatBar value={selectedNode.siteStats.oreDensity} tone="#ffb347" /></dd>
                      <dt>WATER TABLE</dt><dd><span>{selectedNode.siteStats.waterTable}</span><StatBar value={selectedNode.siteStats.waterTable} tone="#3fb3e0" /></dd>
                      <dt>BUILDABLE SLOTS</dt><dd><span>{selectedNode.siteStats.buildableSlots}</span><span className="rm-slots" aria-hidden="true">{Array.from({ length: selectedNode.siteStats.buildableSlots }, (_, index) => <i key={index} />)}</span></dd>
                      <dt>THREAT</dt><dd><span>{selectedNode.siteStats.threat}</span><StatBar value={selectedNode.siteStats.threat} tone="#ff3366" /></dd>
                    </dl>
                  </div>
                )}

                <div className="rm-action-wrap">
                  {action ? (
                    <button
                      ref={actionRef}
                      data-region-action="true"
                      aria-label={action.label}
                      onClick={action.onActivate}
                      className="rm-action"
                    >
                      {action.kind === "survey" && "SURVEY · 1 CYCLE"}
                      {action.kind === "travel" && "TRAVEL · 1 CYCLE"}
                      {action.kind === "found" && `FOUND OUTPOST · ${OUTPOST_FOUNDING_COST.metal} METAL · ${OUTPOST_FOUNDING_COST.food} FOOD · ${OUTPOST_FOUNDING_COST.water} WATER`}
                    </button>
                  ) : (
                    <p className="rm-blocked" data-region-block-reason={primaryBlockReason(save, colony.id, selectedNode) ?? undefined}>
                      {unavailableCopy(save, colony.id, originNodeId, selectedNode, source, actionsEnabled)}
                    </p>
                  )}
                </div>
              </>
            ) : <p>NO VISIBLE DESTINATIONS.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

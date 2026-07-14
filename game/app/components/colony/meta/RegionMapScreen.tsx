import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SaveData } from "../../engine/types";
import type { RegionNode } from "../shared/colonyTypes";
import { poiEncounterLabel } from "../region/poiCatalog";
import {
  checkRegionAction,
  OUTPOST_FOUNDING_COST,
  type RegionAction,
  type RegionActionBlockReason,
} from "../region/siteEconomy";
import {
  initialRegionSelection,
  moveRegionSelection,
  reconcileRegionSelection,
  type RegionSelectionDirection,
} from "./regionMapSelection";

export interface RegionMapScreenProps {
  save: SaveData;
  originColonyId: string;
  mode: "pad" | "view";
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

const CYAN = "#00f0ff";

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

function selectedAction(
  save: SaveData,
  originColonyId: string,
  node: RegionNode,
  mode: "pad" | "view",
  callbacks: Pick<RegionMapScreenProps, "onSurvey" | "onTravel" | "onFound">,
): SelectedAction | null {
  if (mode !== "pad" || node.intel === "unknown") return null;
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
  mode: "pad" | "view",
): string {
  if (mode === "view") return "COCKPIT VIEW — REGION ACTIONS ARE UNAVAILABLE. DESCEND TO A COLONY LANDING PAD TO CONTINUE.";
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

export function RegionMapScreen({
  save,
  originColonyId,
  mode,
  onClose,
  onSurvey,
  onTravel,
  onFound,
  initialSelectedNodeId,
}: RegionMapScreenProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const actionRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  useEffect(() => {
    if (!selectedNodeId) return;
    const option = optionRefs.current.get(selectedNodeId);
    option?.focus();
  }, [selectedNodeId]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const invokingControl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [role="option"][tabindex="0"]')];
    optionRefs.current.get(selectedNodeId ?? "")?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", handler);
    return () => {
      root.removeEventListener("keydown", handler);
      if (invokingControl?.isConnected) invokingControl.focus();
    };
  }, []);

  if (!planet || !colony) return null;
  const selectedNode = visibleNodes.find(node => node.id === selectedNodeId) ?? visibleNodes[0] ?? null;
  const action = selectedNode
    ? selectedAction(save, colony.id, selectedNode, mode, { onSurvey, onTravel, onFound })
    : null;
  const visibleIds = new Set(visibleNodeIds);

  const moveSelection = (direction: RegionSelectionDirection) => {
    const next = moveRegionSelection(selectedNodeId, visibleNodeIds, direction);
    if (!next) return;
    setSelectedNodeId(next);
    const option = optionRefs.current.get(next);
    option?.focus();
    option?.scrollIntoView({ block: "nearest" });
  };

  const focusAction = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    event.stopPropagation();
    actionRef.current?.focus();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Region map"
      style={{ position: "fixed", inset: 0, zIndex: 1200, overflow: "auto", background: "#070b12", color: "#e0e6ed", fontFamily: "ui-monospace, Menlo, monospace", padding: 20 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${CYAN}`, paddingBottom: 12 }}>
        <button onClick={onClose}>← BACK</button>
        <div>
          <h1 style={{ margin: 0, color: CYAN }}>ASHFALL REGION</h1>
          <small>{mode === "pad" ? `PAD LINK — ${colony.name}` : "COCKPIT VIEW — ACTIONS LOCKED"}</small>
        </div>
      </header>

      <div style={{ position: "relative", maxWidth: 980, margin: "20px auto" }}>
        <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {edges.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b)).map(([a, b]) => {
            const from = nodes.find(node => node.id === a)!;
            const to = nodes.find(node => node.id === b)!;
            return <line key={`${a}:${b}`} x1={from.coords.x} y1={from.coords.y} x2={to.coords.x} y2={to.coords.y} stroke="#295066" strokeWidth="0.5" />;
          })}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "start", position: "relative" }}>
          <div
            role="listbox"
            aria-label="Region destinations"
            data-region-node-list="true"
            style={{ display: "grid", gap: 12 }}
          >
            {visibleNodes.map(node => {
              const label = nodeLabel(node);
              const selected = node.id === selectedNode?.id;
              const connections = edges
                .filter(([a, b]) => a === node.id || b === node.id)
                .map(([a, b]) => nodes.find(neighbor => neighbor.id === (a === node.id ? b : a)))
                .filter((neighbor): neighbor is RegionNode => Boolean(neighbor))
                .map(neighbor => nodeLabel(neighbor))
                .join(", ");
              return (
                <article
                  key={node.id}
                  ref={element => {
                    if (element) optionRefs.current.set(node.id, element);
                    else optionRefs.current.delete(node.id);
                  }}
                  role="option"
                  aria-selected={selected}
                  aria-label={`${label}, ${node.intel}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={event => {
                    setSelectedNodeId(node.id);
                    event.currentTarget.focus();
                  }}
                  onKeyDown={event => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveSelection("next");
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveSelection("previous");
                    } else {
                      focusAction(event);
                    }
                  }}
                  style={{
                    border: selected ? `2px solid ${CYAN}` : "1px solid #234052",
                    boxShadow: selected ? "0 0 0 2px rgba(0,240,255,.18), 0 0 18px rgba(0,240,255,.18)" : "none",
                    background: selected ? "rgba(0,74,92,.72)" : "rgba(8,20,30,.9)",
                    padding: 14,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <strong style={{ color: selected ? "#ffffff" : CYAN }}>{label}</strong>{" "}
                  <span>{node.intel.toUpperCase()}</span>
                  <p>Connections: {connections || "None"}</p>
                </article>
              );
            })}
          </div>

          <section
            data-region-detail-panel="true"
            aria-live="polite"
            style={{ position: "sticky", top: 12, border: `1px solid ${CYAN}`, background: "rgba(4,12,20,.97)", padding: 18, minHeight: 260 }}
          >
            {selectedNode ? (
              <>
                <small style={{ color: "#8aa7b8" }}>SELECTED DESTINATION</small>
                <h2 style={{ color: CYAN, margin: "8px 0 16px" }}>{nodeLabel(selectedNode)}</h2>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", margin: 0 }}>
                  <dt>INTEL</dt><dd style={{ margin: 0 }}>{selectedNode.intel.toUpperCase()}</dd>
                  <dt>ENCOUNTER</dt><dd style={{ margin: 0 }}>{selectedNode.intel === "unknown" ? "UNKNOWN" : (poiEncounterLabel(selectedNode) ?? (selectedNode.type === "colony_site" ? "COLONY SITE" : "UNAVAILABLE"))}</dd>
                  {selectedNode.id !== originNodeId && selectedNode.intel !== "unknown" && <><dt>TRAVEL COST</dt><dd style={{ margin: 0 }}>1 CYCLE</dd></>}
                </dl>

                {selectedNode.siteStats && selectedNode.intel !== "unknown" && selectedNode.intel !== "rumored" && (
                  <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", marginTop: 18 }}>
                    <dt>ORE DENSITY</dt><dd style={{ margin: 0 }}>{selectedNode.siteStats.oreDensity}</dd>
                    <dt>WATER TABLE</dt><dd style={{ margin: 0 }}>{selectedNode.siteStats.waterTable}</dd>
                    <dt>BUILDABLE SLOTS</dt><dd style={{ margin: 0 }}>{selectedNode.siteStats.buildableSlots}</dd>
                    <dt>THREAT</dt><dd style={{ margin: 0 }}>{selectedNode.siteStats.threat}</dd>
                  </dl>
                )}

                <div style={{ borderTop: "1px solid #234052", marginTop: 18, paddingTop: 18 }}>
                  {action ? (
                    <button
                      ref={actionRef}
                      data-region-action="true"
                      aria-label={action.label}
                      onClick={action.onActivate}
                      style={{ width: "100%", padding: "14px 16px", border: `2px solid ${CYAN}`, background: "rgba(0,240,255,.12)", color: "#ffffff", font: "inherit", cursor: "pointer" }}
                    >
                      {action.kind === "survey" && "SURVEY · 1 CYCLE"}
                      {action.kind === "travel" && "TRAVEL · 1 CYCLE"}
                      {action.kind === "found" && `FOUND OUTPOST · ${OUTPOST_FOUNDING_COST.metal} METAL · ${OUTPOST_FOUNDING_COST.food} FOOD · ${OUTPOST_FOUNDING_COST.water} WATER`}
                    </button>
                  ) : (
                    <p style={{ margin: 0, color: "#a9bdc8" }} data-region-block-reason={primaryBlockReason(save, colony.id, selectedNode) ?? undefined}>
                      {unavailableCopy(save, colony.id, originNodeId, selectedNode, mode)}
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

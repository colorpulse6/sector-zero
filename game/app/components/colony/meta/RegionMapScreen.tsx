import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SaveData } from "../../engine/types";
import { useModalFocus } from "../../ui/ModalFocus";
import { RegionLandmark, RegionMapTerrain } from "./RegionMapArtwork";
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
    ? "Descend to the landing pad to survey or travel."
    : "Survey and travel are unavailable from this view.";
  if (node.intel === "unknown") return "Explore connected sites to learn more about this signal.";
  if (node.id === originNodeId) return "Choose a destination to plan your next expedition.";
  const checks = (["survey", "travel", "found"] as const).map(action => checkRegionAction(save, originColonyId, node.id, action));
  const reasons = checks.filter(check => !check.allowed).map(check => check.reason);
  if (reasons.includes("target_not_adjacent")) return "Beyond this camp’s reach. Approach from a connected colony.";
  if (reasons.includes("insufficient_resources")) return `Your camp needs ${OUTPOST_FOUNDING_COST.metal} metal, ${OUTPOST_FOUNDING_COST.food} food and ${OUTPOST_FOUNDING_COST.water} water to found an outpost.`;
  if (reasons.includes("site_already_claimed")) return "An established colony already occupies this site.";
  if (reasons.includes("origin_not_claimed") || reasons.includes("origin_node_missing")) return "Establish a camp here before launching an expedition.";
  return "Approach from a connected colony to explore this destination.";
}

function destinationContext(node: RegionNode, originNodeId: string): string {
  if (node.intel === "unknown") return "A faint contact at the edge of known territory.";
  if (node.id === originNodeId) return "Your expedition starts here.";
  if (node.intel === "rumored") return "An unconfirmed report. Survey the site before heading out.";
  if (node.intel === "claimed") return "An established foothold on the surface.";
  if (node.type === "colony_site") return "A surveyed site for your next foothold.";
  return node.intel === "cleared" ? "Explored territory. Previous expedition intel is available." : "Survey complete. An expedition awaits.";
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

  if (!planet || !colony) return null;
  const selectedNode = visibleNodes.find(node => node.id === selectedNodeId) ?? visibleNodes[0] ?? null;
  const action = selectedNode
    ? selectedAction(save, colony.id, selectedNode, actionsEnabled, { onSurvey, onTravel, onFound })
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

  const connections = selectedNode ? edges
    .filter(([a, b]) => a === selectedNode.id || b === selectedNode.id)
    .map(([a, b]) => visibleNodes.find(node => node.id === (a === selectedNode.id ? b : a)))
    .filter((node): node is RegionNode => Boolean(node)) : [];
  const selectedIsOrigin = selectedNode?.id === originNodeId;
  const siteStats = selectedNode?.intel !== "unknown" && selectedNode?.intel !== "rumored"
    ? selectedNode?.siteStats : null;

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Region map" className="sz-region">
      <div className="sz-region-shell">
        <header className="sz-region-header">
          <div>
            <p className="sz-region-eyebrow">SURFACE EXPEDITIONS</p>
            <h1>ASHFALL REGION</h1>
            <p className="sz-region-provenance">
              {source === "atlas" ? "ATLAS LINK" : source === "landing-pad" ? "PAD LINK" : "COCKPIT VIEW"}
              <span aria-hidden="true"> / </span>{colony.name}
              {!actionsEnabled && <span className="sz-region-view-only">View only</span>}
            </p>
          </div>
          <button className="sz-region-back" onClick={onClose}>← {source === "atlas" ? "RETURN TO ATLAS" : source === "landing-pad" ? "RETURN TO LANDING PAD" : "RETURN TO COLONIES"}</button>
        </header>

        <div className="sz-region-layout">
          <div className="sz-region-chart">
            <div className="sz-region-map-caption" aria-hidden="true">
              <span>LOCAL TERRITORY</span><span>ASHFALL / SURFACE</span>
            </div>
            <div className="sz-region-field" data-region-map-field="true">
              <RegionMapTerrain />
              <div className="sz-region-compass" aria-hidden="true"><span>N</span>↑</div>
              <svg className="sz-region-routes" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
                {edges.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b)).map(([a, b]) => {
                  const from = nodes.find(node => node.id === a)!;
                  const to = nodes.find(node => node.id === b)!;
                  const unknown = from.intel === "unknown" || to.intel === "unknown";
                  const selected = !unknown && ((a === originNodeId && b === selectedNode?.id)
                    || (b === originNodeId && a === selectedNode?.id));
                  return <line key={`${a}:${b}`} x1={from.coords.x} y1={from.coords.y} x2={to.coords.x} y2={to.coords.y}
                    data-route-state={selected ? "selected" : unknown ? "unknown" : "known"} vectorEffect="non-scaling-stroke" />;
                })}
              </svg>

              <div role="listbox" aria-label="Region destinations" data-region-node-list="true" className="sz-region-landmarks">
                {visibleNodes.map(node => {
                  const selected = node.id === selectedNode?.id;
                  const origin = node.id === originNodeId;
                  return (
                    <div key={node.id}
                      ref={element => {
                        if (element) optionRefs.current.set(node.id, element);
                        else optionRefs.current.delete(node.id);
                      }}
                      role="option" aria-selected={selected} aria-label={`${nodeLabel(node)}, ${node.intel}`}
                      tabIndex={selected ? 0 : -1} data-region-origin={origin ? "true" : undefined}
                      data-intel={node.intel} className="sz-region-landmark"
                      style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
                      onClick={event => { setSelectedNodeId(node.id); event.currentTarget.focus(); }}
                      onKeyDown={event => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          moveSelection(event.key === "ArrowDown" ? "next" : "previous");
                        } else focusAction(event);
                      }}
                    >
                      <span className="sz-region-marker"><RegionLandmark node={node} /></span>
                      <span className="sz-region-landmark-label">
                        <strong>{nodeLabel(node)}</strong>
                        <span>{origin ? "EXPEDITION ORIGIN" : node.intel === "unknown" ? "UNIDENTIFIED" : node.intel.toUpperCase()}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="sz-region-map-footer">
              <div className="sz-region-legend" aria-label="Map legend">
                <span><i className="sz-region-key-origin" />Origin camp</span>
                <span><i className="sz-region-key-route" />Known route</span>
                <span><i className="sz-region-key-unknown" />Unknown signal</span>
              </div>
              <p>Select a landmark to plan an expedition.</p>
            </div>
          </div>

          <section data-region-detail-panel="true" aria-live="polite" aria-atomic="true" className="sz-region-detail">
            {selectedNode ? (
              <>
                <div className="sz-region-detail-heading">
                  <p className="sz-region-eyebrow">{selectedIsOrigin ? "EXPEDITION ORIGIN" : "SELECTED DESTINATION"}</p>
                  <h2>{nodeLabel(selectedNode)}</h2>
                  <p className="sz-region-context">{destinationContext(selectedNode, originNodeId)}</p>
                </div>
                <dl className="sz-region-facts">
                  <div><dt>INTEL</dt><dd>{selectedNode.intel.toUpperCase()}</dd></div>
                  {!selectedIsOrigin && <div><dt>ENCOUNTER</dt><dd>{selectedNode.intel === "unknown" ? "UNKNOWN" : (poiEncounterLabel(selectedNode) ?? (selectedNode.type === "colony_site" ? "COLONY SITE" : "UNAVAILABLE"))}</dd></div>}
                  {action && action.kind !== "found" && <div><dt>{action.kind === "survey" ? "SURVEY COST" : "TRAVEL COST"}</dt><dd>1 CYCLE</dd></div>}
                </dl>

                <div className="sz-region-action-area">
                  {action ? (
                    <button ref={actionRef} data-region-action="true" aria-label={action.label}
                      disabled={!action.onActivate} onClick={action.onActivate} className="sz-region-action">
                      {action.kind === "survey" && "SURVEY · 1 CYCLE"}
                      {action.kind === "travel" && "TRAVEL · 1 CYCLE"}
                      {action.kind === "found" && `FOUND OUTPOST · ${OUTPOST_FOUNDING_COST.metal} METAL · ${OUTPOST_FOUNDING_COST.food} FOOD · ${OUTPOST_FOUNDING_COST.water} WATER`}
                    </button>
                  ) : <p data-region-block-reason={primaryBlockReason(save, colony.id, selectedNode) ?? undefined}>
                    {unavailableCopy(save, colony.id, originNodeId, selectedNode, source, actionsEnabled)}
                  </p>}
                </div>

                <details className="sz-region-intel" key={selectedNode.id}>
                  <summary tabIndex={0}>SITE INTEL</summary>
                  {siteStats && <dl className="sz-region-site-stats">
                    <div><dt>ORE DENSITY</dt><dd>{siteStats.oreDensity}</dd></div>
                    <div><dt>WATER TABLE</dt><dd>{siteStats.waterTable}</dd></div>
                    <div><dt>BUILDABLE SLOTS</dt><dd>{siteStats.buildableSlots}</dd></div>
                    <div><dt>THREAT</dt><dd>{siteStats.threat}</dd></div>
                  </dl>}
                  <h3>CONNECTED SITES</h3>
                  <ul>{connections.map(node => <li key={node.id}>{nodeLabel(node)}</li>)}</ul>
                  {connections.length === 0 && <p>No charted connections.</p>}
                </details>
              </>
            ) : <p>NO VISIBLE DESTINATIONS.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

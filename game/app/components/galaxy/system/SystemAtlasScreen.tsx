import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlanetId, SaveData } from "../../engine/types";
import type { PlanetBiome } from "../../colony/shared/colonyTypes";
import { useModalFocus } from "../../ui/ModalFocus";
import { BIOME_PALETTES } from "../../colony/meta/regionMapTerrain";
import {
  moveRegionSelection,
  moveRegionSelectionSpatial,
  type RegionSelectionPoint,
} from "../../colony/meta/regionMapSelection";
import {
  findSystem,
  homeSystem,
  neighboursOf,
  planetName,
  systemLabel,
  type StarSystem,
  type SystemNeighbour,
} from "./starSystems";
import { planSystemLayout, PLAN_TILT, type LandmarkPlan } from "./systemLayout";
import { createSystemScene, systemPlanetBiome, type ProjectedLandmark, type SystemSceneHandle } from "./SystemScene";

export interface SystemAtlasScreenProps {
  save: SaveData;
  focusActive?: boolean;
  onClose: () => void;
  onRestoreFocus?: () => void;
  onOpenRegion?: (colonyId: string) => void;
  initialSystemId?: string;
  initialSelectedId?: string;
}

/** Matches the private plan scale in systemLayout.ts (percent per scene unit). */
const PLAN_SCALE = 10.4;

const INTEL_ORDER = ["surveyed", "cleared", "claimed", "rumored", "unknown"] as const;

type LivePoint = { x: number; y: number; visible: boolean };

/** Whole-pixel placement keeps labels crisp and gives slow-moving targets a steady box. */
function placeLandmark(element: HTMLElement, point: LivePoint) {
  const left = `${Math.round(point.x)}px`;
  const top = `${Math.round(point.y)}px`;
  if (element.style.left !== left) element.style.left = left;
  if (element.style.top !== top) element.style.top = top;
  const visible = point.visible ? "true" : "false";
  if (element.dataset.visible !== visible) element.dataset.visible = visible;
}

function selectionFor(system: StarSystem, neighbours: readonly SystemNeighbour[], preferred?: string | null): string | null {
  const ids = planSystemLayout(system, neighbours, 0).map(point => point.id);
  if (preferred && ids.includes(preferred)) return preferred;
  return ids[0] ?? null;
}

function regionIntelSummary(save: SaveData, planetId: PlanetId): string {
  const nodes = save.planets.find(planet => planet.id === planetId)?.regionMap?.nodes;
  if (!nodes || nodes.length === 0) return "No chart";
  const parts = INTEL_ORDER.flatMap(intel => {
    const count = nodes.filter(node => node.intel === intel).length;
    return count > 0 ? [`${count} ${intel.toUpperCase()}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "No chart";
}

export function SystemAtlasScreen({
  save,
  focusActive = true,
  onClose,
  onRestoreFocus,
  onOpenRegion,
  initialSystemId,
  initialSelectedId,
}: SystemAtlasScreenProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const actionRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<SystemSceneHandle | null>(null);
  const livePoints = useRef(new Map<string, LivePoint>());
  const glidingRef = useRef(false);
  const mountedRef = useRef(true);
  const latestRef = useRef({ systemId: "", cycle: 0, colonies: [] as string[], selectedId: null as string | null });

  const [systemId, setSystemId] = useState(() => findSystem(initialSystemId ?? "")?.id ?? homeSystem().id);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const system = findSystem(initialSystemId ?? "") ?? homeSystem();
    return selectionFor(system, neighboursOf(system.id), initialSelectedId);
  });
  const [sceneReady, setSceneReady] = useState(false);
  const [gliding, setGliding] = useState(false);

  const system = findSystem(systemId) ?? homeSystem();
  const neighbours = useMemo(() => neighboursOf(system.id), [system.id]);
  const landmarks = planSystemLayout(system, neighbours, save.missionsSinceStart);
  const colonyPlanetIds = save.colonies.map(colony => colony.planetId);
  const colonyKey = save.colonies.map(colony => `${colony.id}:${colony.planetId}`).join("|");
  latestRef.current = { systemId: system.id, cycle: save.missionsSinceStart, colonies: colonyPlanetIds, selectedId };

  useModalFocus({
    active: focusActive,
    rootRef: dialogRef,
    initialFocus: () => optionRefs.current.get(selectedId ?? "") ?? null,
    onEscape: onClose,
    restoreFocus: onRestoreFocus,
  });

  useLayoutEffect(() => {
    livePoints.current.forEach((point, id) => {
      const element = optionRefs.current.get(id);
      if (!element) return;
      placeLandmark(element, point);
    });
  });

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    if (!canvas || !field) return;
    let cancelled = false;
    let handle: SystemSceneHandle | null = null;
    let observer: ResizeObserver | null = null;
    let unsubscribe = () => {};
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => handle?.setReducedMotion(motion.matches);
    motion.addEventListener("change", applyMotion);

    (async () => {
      try {
        handle = await createSystemScene(canvas);
      } catch {
        return;
      }
      if (cancelled) {
        handle.dispose();
        return;
      }
      sceneRef.current = handle;
      applyMotion();
      const latest = latestRef.current;
      const current = findSystem(latest.systemId) ?? homeSystem();
      handle.setSystem(current, neighboursOf(current.id), latest.cycle, latest.colonies);
      handle.focusLandmark(latest.selectedId);
      unsubscribe = handle.onFrame((projected: ProjectedLandmark[]) => {
        const next = new Map<string, LivePoint>();
        for (const point of projected) {
          next.set(point.id, point);
          const element = optionRefs.current.get(point.id);
          if (element) placeLandmark(element, point);
        }
        livePoints.current = next;
      });
      observer = new ResizeObserver(() => handle?.resize());
      observer.observe(field);
      handle.resize();
      if (!cancelled && mountedRef.current) setSceneReady(true);
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      motion.removeEventListener("change", applyMotion);
      unsubscribe();
      observer?.disconnect();
      sceneRef.current = null;
      handle?.dispose();
    };
  }, []);

  useEffect(() => {
    if (glidingRef.current || !sceneRef.current) return;
    sceneRef.current.setSystem(system, neighbours, save.missionsSinceStart, colonyPlanetIds);
  }, [system, neighbours, save.missionsSinceStart, colonyKey, sceneReady]);

  useEffect(() => {
    sceneRef.current?.focusLandmark(selectedId);
  }, [selectedId, sceneReady, systemId]);

  const home = homeSystem();
  const charted = neighbours.filter(entry => entry.system.knowledge !== "signal").length;
  const signals = neighbours.filter(entry => entry.system.knowledge === "signal").length;
  const selectedPlanet = system.planets.find(planet => `planet:${planet.planetId}` === selectedId) ?? null;
  const selectedNeighbour = neighbours.find(entry => entry.system.id === selectedId) ?? null;
  const selectedColony = selectedPlanet ? save.colonies.find(colony => colony.planetId === selectedPlanet.planetId) ?? null : null;
  const hiddenSystem = system.knowledge === "signal";

  const points = (): RegionSelectionPoint[] => landmarks.map(landmark => {
    const live = livePoints.current.get(landmark.id);
    return { id: landmark.id, x: live?.x ?? landmark.x, y: live?.y ?? landmark.y };
  });

  const focusOption = (next: string | null) => {
    if (!next) return;
    setSelectedId(next);
    const option = optionRefs.current.get(next);
    option?.focus();
    option?.scrollIntoView({ block: "nearest" });
  };

  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(moveRegionSelection(selectedId, landmarks.map(landmark => landmark.id), event.key === "ArrowDown" ? "next" : "previous"));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusOption(moveRegionSelectionSpatial(selectedId, points(), event.key === "ArrowLeft" ? "left" : "right"));
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key !== "Enter" && event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    event.stopPropagation();
    actionRef.current?.focus();
  };

  const viewSystem = async (id: string) => {
    if (glidingRef.current) return;
    const next = findSystem(id);
    if (!next || next.id === system.id) return;
    glidingRef.current = true;
    setGliding(true);
    try {
      await sceneRef.current?.glideToSystem(next.id);
    } catch {
      // A failed glide still changes the view; the flat plan stays usable.
    }
    glidingRef.current = false;
    if (!mountedRef.current) return;
    setGliding(false);
    setSystemId(next.id);
    setSelectedId(selectionFor(next, neighboursOf(next.id)));
    livePoints.current = new Map();
  };

  const action = selectedAction(hiddenSystem ? null : selectedPlanet, selectedNeighbour, selectedColony?.id ?? null, gliding, onOpenRegion, () => {
    if (selectedNeighbour) void viewSystem(selectedNeighbour.system.id);
  });

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="System map" className="sz-system">
      <div className="sz-system-shell">
        <header className="sz-system-header">
          <div>
            <p className="sz-system-eyebrow">SYSTEM ATLAS</p>
            <h1>{systemLabel(system)}</h1>
          </div>
          <div className="sz-system-header-side">
            <button type="button" className="sz-system-back" onClick={onClose}>← RETURN TO COLONIES</button>
            <div className="sz-system-chips" aria-label="System status">
              <span className="sz-system-chip">HOME <b>{home.name.toUpperCase()}</b></span>
              <span className="sz-system-chip">CYCLE <b>{save.missionsSinceStart}</b></span>
              <span className="sz-system-chip">{charted} CHARTED · {signals} SIGNALS</span>
            </div>
          </div>
        </header>

        <div className="sz-system-layout">
          <div className="sz-system-chart">
            <div className="sz-system-map-caption" aria-hidden="true">
              <span>{hiddenSystem ? "UNRESOLVED CONTACT" : `${system.starClass}-CLASS STAR`}</span>
              <span>{hiddenSystem ? "SIGNAL ONLY" : `${system.planets.length} WORLDS · ${neighbours.length} NEIGHBOURS`}</span>
            </div>
            <div
              className="sz-system-field"
              ref={fieldRef}
              data-system-field="true"
              onPointerEnter={() => sceneRef.current?.setSpinPaused(true)}
              onPointerLeave={() => sceneRef.current?.setSpinPaused(false)}
            >
              <canvas ref={canvasRef} className="sz-system-canvas" tabIndex={-1} aria-hidden="true" />
              {!sceneReady && <SystemPlan system={system} neighbours={neighbours} />}
              <span className="sz-system-corner" data-corner="tl" aria-hidden="true" />
              <span className="sz-system-corner" data-corner="tr" aria-hidden="true" />
              <span className="sz-system-corner" data-corner="bl" aria-hidden="true" />
              <span className="sz-system-corner" data-corner="br" aria-hidden="true" />
              <div role="listbox" aria-label="System landmarks" data-system-node-list="true" data-gliding={gliding ? "true" : undefined} aria-busy={gliding || undefined} className="sz-system-landmarks">
                {landmarks.map(landmark => {
                  const view = landmarkView(system, neighbours, landmark, save);
                  const selected = landmark.id === selectedId;
                  return (
                    <div
                      key={landmark.id}
                      ref={element => {
                        if (element) optionRefs.current.set(landmark.id, element);
                        else optionRefs.current.delete(landmark.id);
                      }}
                      role="option"
                      aria-selected={selected}
                      aria-label={`${view.label}, ${view.kind}`}
                      tabIndex={selected ? 0 : -1}
                      data-kind={view.kind}
                      data-colony={view.colony ? "true" : undefined}
                      data-knowledge={view.knowledge}
                      className="sz-system-landmark"
                      style={{ left: `${landmark.x}%`, top: `${landmark.y}%` }}
                      onClick={event => { setSelectedId(landmark.id); event.currentTarget.focus(); }}
                      onFocus={() => setSelectedId(landmark.id)}
                      onKeyDown={onOptionKeyDown}
                    >
                      <span className="sz-system-landmark-bracket" aria-hidden="true" />
                      <span className="sz-system-marker" aria-hidden="true" />
                      <span className="sz-system-landmark-label">
                        <strong>{view.label}</strong>
                        <span>{view.subtitle}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="sz-system-map-footer">
              <div className="sz-system-legend" aria-label="Map legend">
                <span><i className="sz-system-key-star" />Star</span>
                <span><i className="sz-system-key-planet" />Planet</span>
                <span><i className="sz-system-key-colony" />Colony planet</span>
                <span><i className="sz-system-key-unknown" />Unknown system</span>
                <span><i className="sz-system-key-lane" />Lane</span>
              </div>
              <p className="sz-system-keys" aria-hidden="true">
                <span><kbd>↑</kbd> <kbd>↓</kbd> next landmark</span>
                <span><kbd>←</kbd> <kbd>→</kbd> jump across the chart</span>
                <span><kbd>Enter</kbd> / <kbd>Z</kbd> go to action</span>
                <span><kbd>Esc</kbd> back</span>
              </p>
            </div>
          </div>

          <section data-system-detail-panel="true" aria-live="polite" aria-atomic="true" className="sz-system-detail">
            {selectedPlanet ? (
              <PlanetDetail
                save={save}
                system={system}
                planetId={selectedPlanet.planetId}
                colonyName={selectedColony ? `${selectedColony.name} · ${selectedColony.tier}` : "None"}
                hiddenSystem={hiddenSystem}
              />
            ) : selectedNeighbour ? (
              <SystemDetail neighbour={selectedNeighbour} />
            ) : (
              <p className="sz-system-context">Select a world or a neighbouring system.</p>
            )}
            <div className="sz-system-action-area">
              {action ? (
                <button
                  ref={actionRef}
                  type="button"
                  data-system-action="true"
                  aria-label={action.ariaLabel}
                  disabled={action.disabled}
                  onClick={action.onClick}
                  className="sz-system-action"
                >
                  {action.label}
                </button>
              ) : (
                <p>{unavailableCopy(selectedPlanet, selectedNeighbour, hiddenSystem)}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function landmarkView(system: StarSystem, neighbours: readonly SystemNeighbour[], landmark: LandmarkPlan, save: SaveData) {
  if (landmark.kind === "planet") {
    const planetId = landmark.id.slice("planet:".length) as PlanetId;
    const colony = save.colonies.some(entry => entry.planetId === planetId);
    const biome: PlanetBiome = systemPlanetBiome(planetId);
    const hidden = system.knowledge === "signal";
    return {
      kind: "planet" as const,
      label: hidden ? "UNKNOWN WORLD" : planetName(planetId),
      subtitle: hidden ? "UNRESOLVED" : colony ? "COLONY" : BIOME_PALETTES[biome].label.toUpperCase(),
      colony,
      knowledge: undefined,
    };
  }
  const neighbour = neighbours.find(entry => entry.system.id === landmark.id);
  const knowledge = neighbour?.system.knowledge;
  const hidden = knowledge === "signal";
  return {
    kind: "system" as const,
    label: neighbour ? systemLabel(neighbour.system) : "UNKNOWN SYSTEM",
    subtitle: hidden || !neighbour ? "SIGNAL" : `${neighbour.distanceUnits} UNITS`,
    colony: false,
    knowledge,
  };
}

function PlanetDetail({
  save,
  system,
  planetId,
  colonyName,
  hiddenSystem,
}: {
  save: SaveData;
  system: StarSystem;
  planetId: PlanetId;
  colonyName: string;
  hiddenSystem: boolean;
}) {
  const biome = BIOME_PALETTES[systemPlanetBiome(planetId)].label.toUpperCase();
  if (hiddenSystem) {
    return (
      <>
        <p className="sz-system-eyebrow">UNRESOLVED CONTACT</p>
        <h2>UNKNOWN WORLD</h2>
        <p className="sz-system-context">A faint contact. Chart the system before surveying its worlds.</p>
        <dl className="sz-system-facts">
          <div><dt>INTEL</dt><dd>SIGNAL</dd></div>
        </dl>
      </>
    );
  }
  return (
    <>
      <p className="sz-system-eyebrow">{colonyName === "None" ? "SELECTED WORLD" : "COLONY WORLD"}</p>
      <h2>{planetName(planetId)}</h2>
      <p className="sz-system-context">
        {colonyName === "None"
          ? "No colony holds this world yet."
          : "A colony holds the surface. The region chart is ready."}
      </p>
      <dl className="sz-system-facts">
        <div><dt>BIOME</dt><dd>{biome}</dd></div>
        <div><dt>SYSTEM</dt><dd>{systemLabel(system)}</dd></div>
        <div><dt>COLONY</dt><dd>{colonyName}</dd></div>
        <div><dt>REGION INTEL</dt><dd>{regionIntelSummary(save, planetId)}</dd></div>
      </dl>
    </>
  );
}

function SystemDetail({ neighbour }: { neighbour: SystemNeighbour }) {
  const hidden = neighbour.system.knowledge === "signal";
  if (hidden) {
    return (
      <>
        <p className="sz-system-eyebrow">UNRESOLVED CONTACT</p>
        <h2>UNKNOWN SYSTEM</h2>
        <p className="sz-system-context">A faint contact at the edge of the chart.</p>
        <dl className="sz-system-facts">
          <div><dt>INTEL</dt><dd>SIGNAL</dd></div>
        </dl>
      </>
    );
  }
  return (
    <>
      <p className="sz-system-eyebrow">{neighbour.system.knowledge === "home" ? "HOME SYSTEM" : "SELECTED SYSTEM"}</p>
      <h2>{neighbour.system.name}</h2>
      <p className="sz-system-context">A charted neighbour. Viewing it does not spend a cycle.</p>
      <dl className="sz-system-facts">
        <div><dt>STAR CLASS</dt><dd>{neighbour.system.starClass}</dd></div>
        <div><dt>DISTANCE</dt><dd>{neighbour.distanceUnits} UNITS</dd></div>
        <div><dt>KNOWN PLANETS</dt><dd>{neighbour.system.planets.length}</dd></div>
      </dl>
    </>
  );
}

function selectedAction(
  planet: { planetId: PlanetId } | null,
  neighbour: SystemNeighbour | null,
  colonyId: string | null,
  gliding: boolean,
  onOpenRegion: ((colonyId: string) => void) | undefined,
  onView: () => void,
): { label: string; ariaLabel: string; disabled: boolean; onClick: () => void } | null {
  if (planet && colonyId) {
    return {
      label: "OPEN REGION CHART",
      ariaLabel: `Open region chart for ${planetName(planet.planetId)}`,
      disabled: gliding || !onOpenRegion,
      onClick: () => onOpenRegion?.(colonyId),
    };
  }
  if (neighbour && neighbour.system.knowledge !== "signal") {
    return {
      label: `VIEW SYSTEM · ${neighbour.distanceUnits} UNITS`,
      ariaLabel: `View ${neighbour.system.name}`,
      disabled: gliding,
      onClick: onView,
    };
  }
  return null;
}

function unavailableCopy(planet: { planetId: PlanetId } | null, neighbour: SystemNeighbour | null, hiddenSystem = false): string {
  if (neighbour?.system.knowledge === "signal" || (planet && hiddenSystem)) return "Signal only. Chart it from the Galaxy Atlas.";
  if (planet) return "Landing authority needed. Found a colony here from the Galaxy Atlas before charting the surface.";
  return "Select a world or a neighbouring system.";
}

function SystemPlan({ system, neighbours }: { system: StarSystem; neighbours: readonly SystemNeighbour[] }) {
  return (
    <svg className="sz-system-plan" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
      {system.planets.map(planet => (
        <ellipse
          key={planet.planetId}
          cx={50}
          cy={50}
          rx={planet.orbitRadius * PLAN_SCALE}
          ry={planet.orbitRadius * PLAN_SCALE * PLAN_TILT}
        />
      ))}
      {neighbours.map(neighbour => {
        const point = planSystemLayout(system, [neighbour], 0)[1] ?? planSystemLayout(system, [neighbour], 0)[0];
        if (!point) return null;
        const signal = neighbour.system.knowledge === "signal";
        return (
          <line
            key={neighbour.system.id}
            x1={50}
            y1={50}
            x2={point.x}
            y2={point.y}
            data-lane={signal ? "signal" : "charted"}
          />
        );
      })}
      <circle cx={50} cy={50} r={1.4} className="sz-system-plan-star" />
    </svg>
  );
}

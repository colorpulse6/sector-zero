export type RegionSelectionDirection = "next" | "previous";

export function initialRegionSelection(
  visibleNodeIds: readonly string[],
  originNodeId: string | null | undefined,
): string | null {
  if (originNodeId && visibleNodeIds.includes(originNodeId)) return originNodeId;
  return visibleNodeIds[0] ?? null;
}

export function reconcileRegionSelection(
  selectedNodeId: string | null,
  visibleNodeIds: readonly string[],
  originNodeId: string | null | undefined,
): string | null {
  if (selectedNodeId && visibleNodeIds.includes(selectedNodeId)) return selectedNodeId;
  return initialRegionSelection(visibleNodeIds, originNodeId);
}

export function moveRegionSelection(
  selectedNodeId: string | null,
  visibleNodeIds: readonly string[],
  direction: RegionSelectionDirection,
): string | null {
  if (visibleNodeIds.length === 0) return null;
  const currentIndex = visibleNodeIds.indexOf(selectedNodeId ?? "");
  if (currentIndex < 0) return visibleNodeIds[0];
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + visibleNodeIds.length) % visibleNodeIds.length;
  return visibleNodeIds[nextIndex];
}

export type RegionSpatialDirection = "left" | "right" | "up" | "down";

export interface RegionSelectionPoint {
  id: string;
  x: number;
  y: number;
}

/**
 * Spatial movement across the chart: pick the nearest visible node that lies
 * in the requested direction from the current selection. Nodes that are only
 * marginally in that direction are penalised by their perpendicular offset so
 * the jump feels like a straight line rather than a diagonal surprise. Returns
 * null when nothing lies that way, so the caller keeps the current selection.
 */
export function moveRegionSelectionSpatial(
  selectedNodeId: string | null,
  points: readonly RegionSelectionPoint[],
  direction: RegionSpatialDirection,
): string | null {
  if (points.length === 0) return null;
  const current = points.find(point => point.id === selectedNodeId);
  if (!current) return points[0].id;
  let best: { id: string; score: number } | null = null;
  for (const point of points) {
    if (point.id === current.id) continue;
    const dx = point.x - current.x;
    const dy = point.y - current.y;
    const forward = direction === "right" ? dx : direction === "left" ? -dx : direction === "down" ? dy : -dy;
    if (forward <= 0) continue;
    const lateral = Math.abs(direction === "left" || direction === "right" ? dy : dx);
    const score = Math.hypot(dx, dy) + lateral * 1.5;
    if (!best || score < best.score || (score === best.score && point.id < best.id)) best = { id: point.id, score };
  }
  return best?.id ?? null;
}

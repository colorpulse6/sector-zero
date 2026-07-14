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

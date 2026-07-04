/**
 * Tier-1 Outpost template — fixed 24×24 frame with perimeter walls,
 * 6 slots around a central plaza, landing pad south-center.
 *
 * Slots are ordered by index (0-5) but assigned to buildings via
 * layoutSeed-rotated insertion order. See Section C of the Phase 2 spec.
 */

export interface Slot {
  id: 0 | 1 | 2 | 3 | 4 | 5;
  anchorX: number;
  anchorY: number;
  maxFootprint: { w: number; h: number };
}

export const OUTPOST_TEMPLATE = {
  width: 24,
  height: 24,
  spawn: { x: 11, y: 22, facing: "north" as const },
  landingPad: { x: 10, y: 19, w: 4, h: 4 },  // tile region
  plaza: { x: 6, y: 8, w: 8, h: 7 },          // tile region
  slots: [
    { id: 0, anchorX:  2, anchorY:  2, maxFootprint: { w: 4, h: 4 } },  // NW
    { id: 1, anchorX: 18, anchorY:  2, maxFootprint: { w: 4, h: 4 } },  // NE
    { id: 2, anchorX:  2, anchorY:  7, maxFootprint: { w: 4, h: 4 } },  // W-mid
    { id: 3, anchorX: 18, anchorY:  7, maxFootprint: { w: 4, h: 4 } },  // E-mid
    { id: 4, anchorX:  2, anchorY: 15, maxFootprint: { w: 4, h: 4 } },  // SW
    { id: 5, anchorX: 18, anchorY: 15, maxFootprint: { w: 4, h: 4 } },  // SE
  ] as const satisfies readonly Slot[],
};

export type SlotId = (typeof OUTPOST_TEMPLATE.slots)[number]["id"];
